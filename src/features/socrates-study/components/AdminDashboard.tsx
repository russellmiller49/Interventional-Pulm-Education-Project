'use client'
import { useEffect, useState } from 'react'
import { completionSummary, type DashboardData } from '../reporting'
import { api } from './shared'
import styles from './study.module.css'
export function AdminDashboard({ locale }: { locale: string }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [config, setConfig] = useState('')
  const [studyId, setStudyId] = useState('')
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  async function reload() {
    setData(await api<DashboardData>('admin/dashboard'))
  }
  useEffect(() => {
    void reload().catch((e) => setError(e.message))
  }, [])
  async function mutate(path: string, body: unknown) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api(path, body)
      setNotice('Saved.')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.')
    } finally {
      setBusy(false)
    }
  }
  const summary = data ? completionSummary(data) : []
  return (
    <>
      <div className={styles.eyebrow}>Study administration</div>
      <h1>SOCRATES study dashboard</h1>
      <nav className={styles.nav}>
        <a href={`/${locale}/socrates-builder`}>Case builder and readiness</a>
        <a href="/api/socrates/admin/export" download="socrates-study.csv">
          Download research CSV
        </a>
      </nav>
      <p>
        Export uses coded site user IDs. Free text is excluded from the CSV because it can contain
        unreviewed identifiers. Full responses remain available to study administrators below.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!data && !error && <p>Loading study data…</p>}
      {data && (
        <>
          <div className={styles.cards}>
            <article className={styles.card}>
              <strong>{summary.filter((p) => p.started).length}</strong>
              <p>Participant enrollments started</p>
            </article>
            <article className={styles.card}>
              <strong>{summary.filter((p) => p.completed).length}</strong>
              <p>Participant enrollments completed</p>
            </article>
            <article className={styles.card}>
              <strong>{data.training.filter((p) => p.completed_at).length}</strong>
              <p>Training case revisions completed</p>
            </article>
          </div>
          <h2>Participant progress</h2>
          <div
            className={styles.tableWrap}
            role="region"
            aria-label="Participant progress"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Study</th>
                  <th>Training completed</th>
                  <th>Rounds</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((p) => (
                  <tr key={`${p.studyId}:${p.userId}`}>
                    <td>{p.userId}</td>
                    <td>
                      {String(data.studies.find((s) => s.id === p.studyId)?.title ?? p.studyId)}
                    </td>
                    <td>{p.trainingCompleted}</td>
                    <td>
                      {p.rounds.map((r) => (
                        <p key={r.key}>
                          {r.title}: {r.completed}/{r.total}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Case responses and missing submissions</h2>
          <div
            className={styles.tableWrap}
            role="region"
            aria-label="Case response counts"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Study / round</th>
                  <th>Case / revision</th>
                  <th>Submitted</th>
                  <th>Missing submissions</th>
                </tr>
              </thead>
              <tbody>
                {data.cases.map((c) => {
                  const responses = data.attempts.filter(
                    (a) =>
                      a.study_id === c.study_id &&
                      a.round_key === c.round_key &&
                      a.case_id === c.case_id &&
                      a.submitted_at,
                  ).length
                  const enrolled = data.participants.filter((p) => p.study_id === c.study_id).length
                  return (
                    <tr key={`${c.study_id}:${c.round_key}:${c.case_id}`}>
                      <td>
                        {String(c.study_id)} / {String(c.round_key)}
                      </td>
                      <td>
                        {String(c.case_id)} · v{String(c.case_revision)}
                      </td>
                      <td>{responses}</td>
                      <td>{Math.max(0, enrolled - responses)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <h2>Interpretation data</h2>
          <div
            className={styles.tableWrap}
            role="region"
            aria-label="Interpretation data"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Participant / study version</th>
                  <th>Round / case order</th>
                  <th>Elapsed (seconds)</th>
                  <th>Confidence</th>
                  <th>Missing items</th>
                  <th>Responses</th>
                </tr>
              </thead>
              <tbody>
                {data.attempts.map((a) => (
                  <tr key={String(a.id)}>
                    <td>
                      {String(a.user_id)} / {String(a.study_version)}
                    </td>
                    <td>
                      {String(a.round_key)} / {String(a.case_order)}
                    </td>
                    <td>
                      {a.elapsed_ms === null
                        ? 'In progress'
                        : (Number(a.elapsed_ms) / 1000).toFixed(1)}
                    </td>
                    <td>{String(a.confidence ?? '—')}</td>
                    <td>{Array.isArray(a.missing_items) ? a.missing_items.join(', ') : ''}</td>
                    <td>
                      <pre style={{ whiteSpace: 'pre-wrap' }}>
                        {JSON.stringify(a.responses, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className={styles.panel}>
            <h2>Study configuration</h2>
            <p>
              Import a reviewed study JSON configuration with case IDs and saved revisions from the
              builder. Define Round 1 and Round 2 as needed. Activation freezes the configuration;
              use a new study/version for changes.
            </p>
            <p>
              <a href="/socrates-study-template.json" download>
                Download synthetic study configuration template
              </a>
            </p>
            <label>
              Study configuration JSON
              <textarea value={config} onChange={(e) => setConfig(e.target.value)} rows={10} />
            </label>
            <button
              disabled={busy || !config.trim()}
              onClick={() => {
                try {
                  void mutate('admin/study', JSON.parse(config))
                } catch {
                  setError('Enter valid JSON.')
                }
              }}
            >
              Save study configuration
            </button>
            <div className={styles.cards}>
              {data.studies.map((s) => (
                <article key={String(s.id)} className={styles.card}>
                  <h3>
                    {String(s.title)} · {String(s.version)}
                  </h3>
                  <p>{String(s.id)}</p>
                  <p>{s.active ? 'Active' : s.activated_at ? 'Paused' : 'Draft'}</p>
                  {Boolean(s.activated_at) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void mutate('admin/active', { studyId: s.id, active: !s.active })
                      }
                    >
                      {s.active ? 'Pause' : 'Resume'} study
                    </button>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <h2>Participant enrollment</h2>
            <p>
              Use an existing verified site user ID with the SOCRATES participant entitlement. Do
              not enter a name or email address here.
            </p>
            <label>
              Study
              <select value={studyId} onChange={(e) => setStudyId(e.target.value)}>
                <option value="">Select a study</option>
                {data.studies.map((s) => (
                  <option key={String(s.id)} value={String(s.id)}>
                    {String(s.title)} · {String(s.version)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Participant user ID
              <input value={userId} onChange={(e) => setUserId(e.target.value)} />
            </label>
            <div className={styles.controls}>
              <button
                disabled={busy || !studyId || !userId}
                onClick={() => void mutate('admin/enroll', { studyId, userId, active: true })}
              >
                Enroll participant
              </button>
              <button
                disabled={busy || !studyId || !userId}
                onClick={() => void mutate('admin/enroll', { studyId, userId, active: false })}
              >
                Deactivate enrollment
              </button>
            </div>
          </section>
        </>
      )}
    </>
  )
}
